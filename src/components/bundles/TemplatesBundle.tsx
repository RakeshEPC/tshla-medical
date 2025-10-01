/**
 * Templates Bundle - Lazy loaded template management system
 * Groups all template-related components for code splitting
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Loading spinner for Templates features
const TemplatesLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading Templates...</p>
    </div>
  </div>
);

// Lazy load template components
const DoctorTemplates = lazy(() => import('../../pages/DoctorTemplates'));
const TemplateList = lazy(() => import('../../pages/TemplateList'));
const TemplateImportExport = lazy(() => import('../../pages/TemplateImportExport'));
const SimplifiedTemplateBuilder = lazy(() => import('../../pages/SimplifiedTemplateBuilder'));
const TemplateDebug = lazy(() => import('../../pages/TemplateDebug'));
const FixTemplateIssues = lazy(() => import('../../pages/FixTemplateIssues'));
const RestoreTemplate = lazy(() => import('../../pages/RestoreTemplate'));
const AddCustomTemplate = lazy(() => import('../../pages/AddCustomTemplate'));

export default function TemplatesBundle() {
  return (
    <Suspense fallback={<TemplatesLoader />}>
      <Routes>
        {/* Main Templates Routes */}
        <Route index element={<Navigate to="/templates/list" replace />} />
        <Route path="list" element={<TemplateList />} />
        <Route path="doctor" element={<DoctorTemplates />} />
        <Route path="builder" element={<SimplifiedTemplateBuilder />} />
        <Route path="add-custom" element={<AddCustomTemplate />} />

        {/* Import/Export */}
        <Route path="import-export" element={<TemplateImportExport />} />

        {/* Debugging & Maintenance */}
        <Route path="debug" element={<TemplateDebug />} />
        <Route path="fix-issues" element={<FixTemplateIssues />} />
        <Route path="restore" element={<RestoreTemplate />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/templates/list" replace />} />
      </Routes>
    </Suspense>
  );
}
