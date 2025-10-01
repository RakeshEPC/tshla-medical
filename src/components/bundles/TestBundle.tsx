/**
 * Test Bundle - Lazy loaded testing and development features (dev only)
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const TestLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading Test Tools...</p>
    </div>
  </div>
);

// Testing components (removed deleted test pages)
const CleanTest = lazy(() => import('../../pages/CleanTest'));
const QuickQualityTest = lazy(() => import('../../pages/QuickQualityTest'));
const QualityTest = lazy(() => import('../../pages/QualityTest'));
const PrintNotePage = lazy(() => import('../../pages/PrintNotePage'));
const PrintProcessedNote = lazy(() => import('../../pages/PrintProcessedNote'));
const VisitSummary = lazy(() => import('../../pages/VisitSummary'));

export default function TestBundle() {
  // Only available in development
  if (process.env.NODE_ENV !== 'development') {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<TestLoader />}>
      <Routes>
        <Route index element={<Navigate to="/test/clean" replace />} />
        <Route path="clean" element={<CleanTest />} />
        <Route path="quality-quick" element={<QuickQualityTest />} />
        <Route path="quality" element={<QualityTest />} />
        <Route path="print-note" element={<PrintNotePage />} />
        <Route path="print-processed" element={<PrintProcessedNote />} />
        <Route path="visit-summary" element={<VisitSummary />} />
        <Route path="*" element={<Navigate to="/test/clean" replace />} />
      </Routes>
    </Suspense>
  );
}
