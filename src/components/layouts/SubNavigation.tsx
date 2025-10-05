import React from "react";

interface SubNavigationProps {
  children: React.ReactNode;
}

export function SubNavigation({ children }: SubNavigationProps) {
  return (
    <div className="border-b bg-white/95 backdrop-blur-sm sticky top-16 z-30 shadow-sm overflow-x-auto">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex justify-end items-center min-w-max sm:min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {children}
        </div>
      </div>
    </div>
  );
}