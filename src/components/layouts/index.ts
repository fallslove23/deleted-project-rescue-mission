// src/components/layouts/index.ts

// New layout system
export { BaseLayout } from './BaseLayout';
export { DashboardLayout } from './DashboardLayout';
export { PageHeader } from './PageHeader';
export { SubNavigation } from './SubNavigation';
export { LayoutProvider, useLayout } from './LayoutProvider';

// Legacy layout (keep for gradual migration)
export { default as AdminLayout } from "./AdminLayout";
export type { AdminLayoutProps } from "./AdminLayout";
export { GlobalNavBar } from "./GlobalNavBar";
