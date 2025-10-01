/**
 * Weight Loss Bundle - Lazy loaded weight management program
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const WeightLossLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading Weight Loss Program...</p>
    </div>
  </div>
);

const WeightLossOnboarding = lazy(() => import('../../pages/WeightLossOnboarding'));
const WeightLossOnboardingSummary = lazy(() => import('../../pages/WeightLossOnboardingSummary'));
const WeightLossCheckin = lazy(() => import('../../pages/WeightLossCheckin'));
const WeightLossDashboard = lazy(() => import('../../pages/WeightLossDashboard'));

export default function WeightLossBundle() {
  return (
    <Suspense fallback={<WeightLossLoader />}>
      <Routes>
        <Route index element={<Navigate to="/weight-loss/dashboard" replace />} />
        <Route path="onboarding" element={<WeightLossOnboarding />} />
        <Route path="summary" element={<WeightLossOnboardingSummary />} />
        <Route path="checkin" element={<WeightLossCheckin />} />
        <Route path="dashboard" element={<WeightLossDashboard />} />
        <Route path="*" element={<Navigate to="/weight-loss/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
