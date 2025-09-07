import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
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
    <div className="min-h-screen flex w-full bg-background overflow-x-hidden sidebar-purple">
      <div className="sidebar-purple">
        <AdminSidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 scrollable-y">
        {/* Header - 더 컴팩트하게 */}
        <header className="h-12 border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm ios-safe-area">
          <div className="flex items-center h-full px-2 sm:px-3 max-w-full overflow-hidden">
            {/* Left: Sidebar Toggle */}
            <div className="flex items-center shrink-0">
              <SidebarTrigger className="h-7 w-7 p-1 mr-2" />
            </div>

            {/* Center: Page Title */}
            <div className="flex-1 text-center min-w-0 px-1">
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shrink-0">
                  <BarChart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                </div>
                <h1 className="text-xs sm:text-sm md:text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent break-words leading-tight line-clamp-1 font-display">
                  {title}
                </h1>
              </div>
              {description && (
                <p className="text-xs text-muted-foreground break-words line-clamp-1 mt-0.5 hidden sm:block font-sans">
                  {description}
                </p>
              )}
            </div>

            {/* Right: User Actions */}
            <div className="flex items-center space-x-1 shrink-0">
              {/* User Email - Only on larger screens */}
              <span className="hidden lg:block text-xs text-muted-foreground max-w-20 truncate font-sans">
                {user?.email}
              </span>

              {/* Student View Button */}
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                size="sm"
                className="h-7 px-2 hidden md:inline-flex text-xs"
                title="교육생 화면"
              >
                <Home className="h-3 w-3 sm:mr-1" />
                <span className="hidden lg:inline font-sans">교육생</span>
              </Button>

              {/* Activity Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 sm:w-72">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <h3 className="font-semibold text-sm font-display">최근 활동</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-sans">시스템 상태</span>
                        <span className="text-sm text-green-600 font-medium font-sans">정상</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-sans">
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
                className="h-7 w-7 p-0"
              >
                <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main content - 컴팩트한 패딩 */}
        <main className="flex-1 p-2 sm:p-3 md:p-4 touch-scroll safe-bottom compact-content">
          <div className="max-w-full overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}