import React from "react";

interface SubNavigationProps {
  children: React.ReactNode;
}

export function SubNavigation({ children }: SubNavigationProps) {
  return (
    <div className="border-b bg-white/95 backdrop-blur-sm sticky top-16 z-30 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex justify-end items-center">
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    </div>
  );
}