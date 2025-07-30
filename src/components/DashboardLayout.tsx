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
              <div className="flex items-center gap-2 md:gap-3">
                <SidebarTrigger className="h-8 w-8 order-first" />
                <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                      <BarChart className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                    </div>
                    <h1 className="text-base md:text-xl font-bold bg-gradient-accent bg-clip-text text-transparent text-center truncate">
                      {title}
                    </h1>
                  </div>
                  {description && (
                    <p className="text-xs md:text-sm text-muted-foreground text-center truncate max-w-full">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-xs md:text-sm hidden lg:block truncate max-w-24 md:max-w-32">
                  {user?.email}
                </span>
                <Button onClick={() => navigate('/')} variant="ghost" size="sm" className="text-xs md:text-sm px-2 md:px-3">
                  메인
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative h-8 w-8 md:h-9 md:w-9">
                      <Activity className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 md:w-80">
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
                
                <Button onClick={signOut} variant="outline" size="sm" className="text-xs md:text-sm px-2 md:px-3">
                  로그아웃
                </Button>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-3 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}