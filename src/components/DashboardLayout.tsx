import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AdminSidebar } from './AdminSidebar'
import { BarChart, Activity, Home, LogOut } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  description?: string
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { user, userRoles, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="flex items-center h-full px-2 sm:px-4">
              {/* Left: Sidebar Toggle */}
              <div className="flex items-center">
                <SidebarTrigger className="h-8 w-8 p-1 mr-2" />
              </div>

              {/* Center: Page Title */}
              <div className="flex-1 text-center min-w-0 px-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-6 w-6 sm:h-8 sm:w-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-neon">
                    <BarChart className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                  </div>
                  <h1 className="text-sm sm:text-lg font-bold bg-gradient-accent bg-clip-text text-transparent break-words leading-tight">
                    {title}
                  </h1>
                </div>
                {description && (
                  <p className="text-xs text-muted-foreground break-words line-clamp-1 mt-1">
                    {description}
                  </p>
                )}
              </div>

              {/* Right: User Actions */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                {/* User Email - Only on larger screens */}
                <span className="hidden lg:block text-xs text-muted-foreground max-w-20 truncate">
                  {user?.email}
                </span>

                {/* 교육생 화면 Button */}
                <Button
                  onClick={() => navigate('/?preview=true')}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Home className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">교육생 화면</span>
                </Button>

                {/* Activity Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 sm:w-80">
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
                        <div className="text-xs text-muted-foreground">
                          사용자 역할: {userRoles.join(', ')}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Logout Button */}
                <Button
                  onClick={signOut}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
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