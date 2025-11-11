/**
 * PumpDrive Bundle - Lazy loaded insulin pump selection system
 * Groups all PumpDrive-related components for code splitting
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PumpDriveAuthGuard from '../PumpDriveAuthGuard';

// Loading spinner for PumpDrive features
const PumpDriveLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading PumpDrive...</p>
    </div>
  </div>
);

// Authentication components (use unified PatientLogin page)
const PatientLogin = lazy(() => import('../../pages/PatientLogin'));

// PumpDrive components (require authentication)
const PumpDriveUnified = lazy(() => import('../../pages/PumpDriveUnified'));
const PumpDriveResults = lazy(() => import('../../pages/PumpDriveResults'));
const PumpDriveHTMLReport = lazy(() => import('../../pages/PumpDriveHTMLReport'));
const PumpDriveBilling = lazy(() => import('../../pages/PumpDriveBilling'));
const AssessmentHistory = lazy(() => import('../../pages/pumpdrive/AssessmentHistory'));

// Text-based assessment components (to be implemented)
// const PumpDriveTextAssessment = lazy(() => import('../../pages/PumpDriveTextAssessment'));
// const PumpDrivePaymentProvider = lazy(() => import('../../pages/PumpDrivePaymentProvider'));

export default function PumpDriveBundle() {
  return (
    <Suspense fallback={<PumpDriveLoader />}>
      <Routes>
        {/* Authentication Routes (Public) */}
        <Route path="create-account" element={<Navigate to="/patient-register" replace />} />
        <Route path="login" element={<PatientLogin />} />

        {/* Protected Assessment Routes */}
        <Route path="assessment" element={
          <PumpDriveAuthGuard>
            <PumpDriveUnified />
          </PumpDriveAuthGuard>
        } />
        <Route path="billing" element={
          <PumpDriveAuthGuard>
            <PumpDriveBilling />
          </PumpDriveAuthGuard>
        } />
        <Route path="results" element={
          <PumpDriveAuthGuard>
            <PumpDriveResults />
          </PumpDriveAuthGuard>
        } />
        <Route path="report" element={
          <PumpDriveAuthGuard>
            <PumpDriveHTMLReport />
          </PumpDriveAuthGuard>
        } />
        <Route path="report/:assessmentId" element={
          <PumpDriveAuthGuard>
            <PumpDriveHTMLReport />
          </PumpDriveAuthGuard>
        } />
        <Route path="history" element={
          <PumpDriveAuthGuard>
            <AssessmentHistory />
          </PumpDriveAuthGuard>
        } />

        {/* Text-Based Assessment Flow (Future) */}
        {/* <Route path="text-assessment" element={<PumpDriveTextAssessment />} /> */}
        {/* <Route path="payment-provider" element={<PumpDrivePaymentProvider />} /> */}
        {/* <Route path="provider-sent" element={<PumpDriveProviderSent />} /> */}

        {/* Main Assessment Route (Protected) */}
        <Route index element={
          <PumpDriveAuthGuard>
            <Navigate to="/pumpdrive/assessment" replace />
          </PumpDriveAuthGuard>
        } />

        {/* Fallback - redirect to patient login (not create account) */}
        <Route path="*" element={<Navigate to="/patient-login" replace />} />
      </Routes>
    </Suspense>
  );
}
