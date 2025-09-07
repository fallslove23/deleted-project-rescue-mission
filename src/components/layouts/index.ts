// src/components/layouts/index.ts

// ❌ 금지: export * from "./AdminLayout"
// ⬇️ 정답: default는 명시적으로만 재수출
export { default as AdminLayout } from "./AdminLayout";
export type { AdminLayoutProps } from "./AdminLayout";
