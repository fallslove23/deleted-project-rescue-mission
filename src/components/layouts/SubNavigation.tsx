import React from "react";

interface SubNavigationProps {
  children: React.ReactNode;
}

export function SubNavigation({ children }: SubNavigationProps) {
  return (
    <div className="border-b bg-white/95 backdrop-blur-sm sticky top-[52px] sm:top-16 z-30 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-end gap-2 overflow-x-auto touch-scroll pb-1 -mb-1">
          <div className="flex items-center gap-2 sm:gap-3 min-w-max">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}