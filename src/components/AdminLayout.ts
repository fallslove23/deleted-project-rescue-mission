// src/components/AdminLayout.ts
// 기존에 "@/components/AdminLayout"로 임포트하던 코드 호환용 어댑터
export { default } from "./layouts/AdminLayout";
export { default as AdminLayout } from "./layouts/AdminLayout";
// 타입도 재노출 (있다면)
export type { AdminLayoutProps } from "./layouts/AdminLayout";
