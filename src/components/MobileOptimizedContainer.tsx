import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobileOptimizedContainerProps {
  children: ReactNode
  className?: string
  enableScroll?: boolean
  safeArea?: boolean
  contentClassName?: string
}

export function MobileOptimizedContainer({
  children,
  className,
  enableScroll = true,
  safeArea = true,
  contentClassName
}: MobileOptimizedContainerProps) {
  const content = contentClassName ? (
    <div className={contentClassName}>{children}</div>
  ) : (
    children
  )

  return (
    <div
      className={cn(
        "w-full h-full",
        enableScroll && "touch-scroll mobile-scroll",
        safeArea && "safe-top safe-bottom",
        className
      )}
    >
      {content}
    </div>
  )
}