/**
 * Disease Dashboards - Index
 *
 * Export all disease dashboard components for easy importing.
 */

// Universal Zone Components
export { default as ZoneA_StatusStrip } from './ZoneA_StatusStrip';
export type { StatusType, StatusChange, ZoneAProps } from './ZoneA_StatusStrip';

export { default as ZoneC_PlanMemory } from './ZoneC_PlanMemory';
export type { LastVisitChange, WatchItem, TriggerItem, ZoneCProps } from './ZoneC_PlanMemory';

// Disease-Specific Dashboards
export { default as DiabetesDashboard } from './DiabetesDashboard';
export { default as ThyroidDashboard } from './ThyroidDashboard';
export { default as ThyroidCancerDashboard } from './ThyroidCancerDashboard';
export { default as ThyroidNoduleDashboard } from './ThyroidNoduleDashboard';
export { default as OsteoporosisDashboard } from './OsteoporosisDashboard';

// Dashboard Selector (Auto-detection)
export { default as DashboardSelector } from './DashboardSelector';
export { selectPrimaryDashboard, getApplicableDashboards } from './DashboardSelector';
export type { DashboardType } from './DashboardSelector';
