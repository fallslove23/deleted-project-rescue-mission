// src/pages/DashboardSystemLogs.tsx
// ✅ 대시보드 하위 라우트에서 사용할 래퍼 (레이아웃은 상위에서 적용)
import React from "react";
import SystemLogs from "./SystemLogs";

export default function DashboardSystemLogs() {
  return <SystemLogs />;
}
