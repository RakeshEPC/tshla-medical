/**
 * Admin Bundle - Lazy loaded administrative features
 * Protected by AdminRoute - requires admin role
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AdminRoute from '../AdminRoute';

const AdminLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading Admin Panel...</p>
    </div>
  </div>
);

const AdminAccountCreation = lazy(() => import('../../pages/AdminAccountCreation'));
const AdminAccountManagement = lazy(() => import('../../pages/AdminAccountManagement'));
const QuickAccountSetup = lazy(() => import('../../pages/QuickAccountSetup'));
const PumpDriveUserDashboard = lazy(() => import('../../pages/admin/PumpDriveUserDashboard'));
const PumpComparisonManager = lazy(() => import('../../pages/admin/PumpComparisonManager'));
const PumpDriveAnalytics = lazy(() => import('../../pages/admin/PumpDriveAnalytics'));

export default function AdminBundle() {
  return (
    <AdminRoute>
      <Suspense fallback={<AdminLoader />}>
        <Routes>
          <Route index element={<Navigate to="/admin/accounts" replace />} />
          <Route path="account-creation" element={<AdminAccountCreation />} />
          <Route path="accounts" element={<AdminAccountManagement />} />
          <Route path="quick-setup" element={<QuickAccountSetup />} />
          <Route path="pumpdrive-users" element={<PumpDriveUserDashboard />} />
          <Route path="pumpdrive-dashboard" element={<PumpDriveUserDashboard />} />
          <Route path="pumpdrive-analytics" element={<PumpDriveAnalytics />} />
          <Route path="pump-comparison" element={<PumpComparisonManager />} />
          <Route path="*" element={<Navigate to="/admin/accounts" replace />} />
        </Routes>
      </Suspense>
    </AdminRoute>
  );
}
