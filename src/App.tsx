import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import './styles/pumpdrive-global-mobile.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading TSHLA Medical...</p>
    </div>
  </div>
);

// ========================================
// CORE PAGES (loaded immediately)
// ========================================
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import PatientLogin from './pages/PatientLogin';
import AuthRedirect from './pages/AuthRedirect';

// ========================================
// LAZY-LOADED SECTIONS
// ========================================

// Authentication & Onboarding
const CreateAccount = lazy(() => import('./pages/CreateAccount'));
const AccountVerification = lazy(() => import('./pages/AccountVerification'));
const PracticeSetup = lazy(() => import('./pages/PracticeSetup'));
const MedicalStaffRegister = lazy(() => import('./pages/MedicalStaffRegister'));

// Doctor Dashboard (unified implementation)
const DoctorDashboardUnified = lazy(() => import('./pages/DoctorDashboardUnified'));

// Staff Management
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const StaffWorkflowDashboard = lazy(() => import('./pages/StaffWorkflowDashboard'));
const CaseManagementDashboard = lazy(() => import('./pages/CaseManagementDashboard'));
const MADashboard = lazy(() => import('./pages/MADashboard'));

// Dictation & Notes
const DictationPage = lazy(() => import('./pages/DictationPage'));
const DictationPageEnhanced = lazy(() => import('./pages/DictationPageEnhanced'));
const QuickNote = lazy(() => import('./pages/QuickNote'));
const QuickNoteModern = lazy(() => import('./pages/QuickNoteModern'));

// PumpDrive System (major feature - separate bundle)
const PumpDriveBundle = lazy(() => import('./components/bundles/PumpDriveBundle'));

// PumpDrive Assessment Components (restored)
const PumpDriveUnified = lazy(() => import('./pages/PumpDriveUnified'));
const PumpDriveResults = lazy(() => import('./pages/PumpDriveResults'));
const PumpDriveAssessmentResults = lazy(() => import('./pages/PumpDriveAssessmentResults'));
const PumpDriveSliders = lazy(() => import('./pages/PumpDriveSliders'));
const PumpDriveFreeText = lazy(() => import('./pages/PumpDriveFreeText'));
const PumpFeatureSelection = lazy(() => import('./pages/PumpFeatureSelection'));

// Medical AI & Analysis
const SimranPumpLLM = lazy(() => import('./pages/SimranPumpLLM'));
const SimranPumpLLMDebug = lazy(() => import('./pages/SimranPumpLLMDebug'));
const SimranPumpLLMSimple = lazy(() => import('./pages/SimranPumpLLMSimple'));

// Templates & Documentation
const TemplatesBundle = lazy(() => import('./components/bundles/TemplatesBundle'));

// Patient Management
const PatientBundle = lazy(() => import('./components/bundles/PatientBundle'));

// Weight Loss Program
const WeightLossBundle = lazy(() => import('./components/bundles/WeightLossBundle'));

// Admin Features
const AdminBundle = lazy(() => import('./components/bundles/AdminBundle'));

// Testing & Development (only in dev mode)
const TestBundle = lazy(() => import('./components/bundles/TestBundle'));

// Miscellaneous
const SharedNote = lazy(() => import('./pages/SharedNote'));
const FacebookLanding = lazy(() => import('./pages/FacebookLanding'));
const EarlyAccessAdmin = lazy(() => import('./pages/EarlyAccessAdmin'));
const PatientPortal = lazy(() => import('./pages/PatientPortal'));

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="App">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* ===== CORE ROUTES (no lazy loading) ===== */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/patient-login" element={<PatientLogin />} />
              <Route path="/auth-redirect" element={<AuthRedirect />} />

              {/* ===== AUTHENTICATION & ONBOARDING ===== */}
              <Route
                path="/create-account"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <CreateAccount />
                  </Suspense>
                }
              />
              <Route
                path="/medical/register"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <MedicalStaffRegister />
                  </Suspense>
                }
              />
              <Route
                path="/verify-account"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <AccountVerification />
                  </Suspense>
                }
              />
              <Route
                path="/practice-setup"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PracticeSetup />
                  </Suspense>
                }
              />

              {/* ===== DOCTOR DASHBOARD ===== */}
              {/* All dashboard routes now use the unified implementation */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DoctorDashboardUnified />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-db"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DoctorDashboardUnified />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-modern"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DoctorDashboardUnified />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-unified"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DoctorDashboardUnified />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== STAFF MANAGEMENT ===== */}
              <Route
                path="/staff"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <StaffDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/staff-workflow"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <StaffWorkflowDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/case-management"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <CaseManagementDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ma-dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <MADashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== DICTATION & NOTES ===== */}
              <Route
                path="/dictation/:patientId"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DictationPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dictation-enhanced/:patientId"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DictationPageEnhanced />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quick-note"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <QuickNote />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quick-note-modern"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <QuickNoteModern />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== PUMPDRIVE SYSTEM (AUTHENTICATION-ENABLED BUNDLE) ===== */}
              <Route
                path="/pumpdrive/*"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PumpDriveBundle />
                  </Suspense>
                }
              />

              {/* ===== TEMPLATES & DOCUMENTATION ===== */}
              <Route
                path="/templates/*"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <TemplatesBundle />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== PATIENT MANAGEMENT ===== */}
              <Route
                path="/patients/*"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PatientBundle />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== WEIGHT LOSS PROGRAM ===== */}
              <Route
                path="/weight-loss/*"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <WeightLossBundle />
                  </Suspense>
                }
              />

              {/* ===== ADMIN FEATURES ===== */}
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <AdminBundle />
                  </Suspense>
                }
              />

              {/* ===== PHONE SYSTEM ===== */}

              {/* ===== MEDICAL AI & ANALYSIS ===== */}
              <Route
                path="/simran-pump-llm"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <SimranPumpLLM />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simran-pump-llm-debug"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <SimranPumpLLMDebug />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simran-pump-llm-simple"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <SimranPumpLLMSimple />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== TESTING & DEVELOPMENT (dev only) ===== */}
              {process.env.NODE_ENV === 'development' && (
                <Route
                  path="/test/*"
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <TestBundle />
                    </Suspense>
                  }
                />
              )}

              {/* ===== MISCELLANEOUS ===== */}
              <Route
                path="/shared/:noteId"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <SharedNote />
                  </Suspense>
                }
              />
              <Route
                path="/facebook-landing"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <FacebookLanding />
                  </Suspense>
                }
              />
              <Route
                path="/early-access-admin"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <EarlyAccessAdmin />
                  </Suspense>
                }
              />
              <Route
                path="/patient-portal-demo"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PatientPortal />
                  </Suspense>
                }
              />

              {/* ===== FALLBACK ROUTES ===== */}
              <Route path="/home" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
