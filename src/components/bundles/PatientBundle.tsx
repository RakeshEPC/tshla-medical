/**
 * Patient Bundle - Lazy loaded patient management system
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const PatientLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading Patient Management...</p>
    </div>
  </div>
);

const PatientRegistration = lazy(() => import('../../pages/PatientRegistration'));
const PatientLogin = lazy(() => import('../../pages/PatientLogin'));
const PatientDashboard = lazy(() => import('../../pages/PatientDashboard'));
const PatientChat = lazy(() => import('../../pages/PatientChat'));
const PatientPumpReport = lazy(() => import('../../pages/PatientPumpReport'));

export default function PatientBundle() {
  return (
    <Suspense fallback={<PatientLoader />}>
      <Routes>
        <Route index element={<Navigate to="/patients/dashboard" replace />} />
        <Route path="registration" element={<PatientRegistration />} />
        <Route path="login" element={<PatientLogin />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="chat" element={<PatientChat />} />
        <Route path="pump-report" element={<PatientPumpReport />} />
        <Route path="*" element={<Navigate to="/patients/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
