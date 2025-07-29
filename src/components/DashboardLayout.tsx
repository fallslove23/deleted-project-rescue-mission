import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AdminSidebar } from './AdminSidebar'
import { BarChart, Activity } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  description?: string
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-8 w-8" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                    <BarChart className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold bg-gradient-accent bg-clip-text text-transparent">
                      {title}
                    </h1>
                    {description && (
                      <p className="text-sm text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm hidden sm:block truncate max-w-32">
                  환영합니다, {user?.email}
                </span>
                <Button onClick={() => navigate('/')} variant="ghost" size="sm">
                  설문 메인
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
                      <Activity className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        <h3 className="font-semibold">최근 활동</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">시스템 상태</span>
                          <span className="text-sm text-green-600 font-medium">정상</span>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button onClick={signOut} variant="outline" size="sm">
                  로그아웃
                </Button>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}