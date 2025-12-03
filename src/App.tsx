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
import ResetPassword from './pages/ResetPassword';

// ========================================
// LAZY-LOADED SECTIONS
// ========================================

// Authentication & Onboarding
const CreateAccount = lazy(() => import('./pages/CreateAccount'));
const PatientRegister = lazy(() => import('./pages/PatientRegister'));
const AccountVerification = lazy(() => import('./pages/AccountVerification'));
const PracticeSetup = lazy(() => import('./pages/PracticeSetup'));
const MedicalStaffRegister = lazy(() => import('./pages/MedicalStaffRegister'));

// Doctor Dashboard (unified implementation)
const DoctorDashboardUnified = lazy(() => import('./pages/DoctorDashboardUnified'));

// Staff Management
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const UnifiedStaffDashboard = lazy(() => import('./pages/UnifiedStaffDashboard'));
const StaffWorkflowDashboard = lazy(() => import('./pages/StaffWorkflowDashboard'));
const StaffOrdersQueue = lazy(() => import('./pages/StaffOrdersQueue'));
const CaseManagementDashboard = lazy(() => import('./pages/CaseManagementDashboard'));
const MADashboard = lazy(() => import('./pages/MADashboard'));

// Dictation & Notes
const DictationPageEnhanced = lazy(() => import('./pages/DictationPageEnhanced'));
const QuickNote = lazy(() => import('./pages/QuickNote'));
const QuickNoteModern = lazy(() => import('./pages/QuickNoteModern'));

// Schedule & Calendar
const SchedulePage = lazy(() => import('./pages/SchedulePage'));

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

// Analytics & Reporting
const TemplateAnalytics = lazy(() => import('./pages/TemplateAnalytics'));

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

// Pre-Visit System
const PreVisitDemo = lazy(() => import('./pages/PreVisitDemo'));
const PreVisitAnalyticsDashboard = lazy(() => import('./pages/PreVisitAnalyticsDashboard'));
const PreVisitConversations = lazy(() => import('./pages/PreVisitConversations'));
const PreVisitDataCapture = lazy(() => import('./pages/PreVisitDataCaptureImproved'));
const PatientDataImport = lazy(() => import('./pages/PatientDataImport'));

// Miscellaneous
const SharedNote = lazy(() => import('./pages/SharedNote'));
const FacebookLanding = lazy(() => import('./pages/FacebookLanding'));
const EarlyAccessAdmin = lazy(() => import('./pages/EarlyAccessAdmin'));
const PatientPortal = lazy(() => import('./pages/PatientPortal'));

// Patient Portal (Unified System)
const PatientPortalLogin = lazy(() => import('./pages/PatientPortalLogin'));
const PatientPortalDashboard = lazy(() => import('./pages/PatientPortalDashboard'));
const UnifiedPatientChart = lazy(() => import('./pages/UnifiedPatientChart'));

// PCM (Principal Care Management) System
const SimplePCMPatientDashboard = lazy(() => import('./pages/SimplePCMPatientDashboard'));
const PCMProviderDashboard = lazy(() => import('./pages/PCMProviderDashboard'));
const PCMStaffWorkflow = lazy(() => import('./pages/PCMStaffWorkflow'));
const PCMPatientSetup = lazy(() => import('./pages/PCMPatientSetup'));
const PCMPatientGoals = lazy(() => import('./pages/PCMPatientGoals'));
const PatientConsent = lazy(() => import('./pages/PatientConsent'));
const PCMPatientProfile = lazy(() => import('./pages/PCMPatientProfile'));
const PCMMessages = lazy(() => import('./pages/PCMMessages'));
const PCMLabOrders = lazy(() => import('./pages/PCMLabOrders'));
const PCMPatientLabs = lazy(() => import('./pages/PCMPatientLabs'));

// Diabetes Education System
const DiabetesEducationAdmin = lazy(() => import('./pages/DiabetesEducationAdmin'));
const PCMCallSummaries = lazy(() => import('./pages/PCMCallSummaries'));

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
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/confirm" element={<ResetPassword />} />

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
                path="/patient-register"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PatientRegister />
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
                path="/staff-dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <UnifiedStaffDashboard />
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
                path="/staff-orders"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <StaffOrdersQueue />
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
                      <DictationPageEnhanced />
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

              {/* ===== SCHEDULE & CALENDAR ===== */}
              {/* Redirect to dashboard which has better schedule view with imported Athena data */}
              <Route path="/schedule" element={<Navigate to="/dashboard" replace />} />

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

              {/* ===== ANALYTICS & REPORTING ===== */}
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <TemplateAnalytics />
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

              {/* ===== PRE-VISIT SYSTEM ===== */}
              <Route
                path="/previsit-demo"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PreVisitDemo />
                  </Suspense>
                }
              />
              <Route
                path="/previsit-analytics"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PreVisitAnalyticsDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/previsit-conversations"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PreVisitConversations />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/previsit-data"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PreVisitDataCapture />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient-import"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PatientDataImport />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

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

              {/* ===== PATIENT PORTAL (UNIFIED SYSTEM) ===== */}
              <Route
                path="/patient-portal-login"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PatientPortalLogin />
                  </Suspense>
                }
              />
              <Route
                path="/patient-portal-dashboard"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PatientPortalDashboard />
                  </Suspense>
                }
              />
              <Route
                path="/patient-chart"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <UnifiedPatientChart />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== PCM (PRINCIPAL CARE MANAGEMENT) SYSTEM ===== */}
              {/* Simple Patient Dashboard */}
              <Route
                path="/pcm/patient"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <SimplePCMPatientDashboard />
                  </Suspense>
                }
              />
              <Route
                path="/pcm/patient/:patientId"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <SimplePCMPatientDashboard />
                  </Suspense>
                }
              />

              {/* Provider PCM Management Dashboard */}
              <Route
                path="/pcm/provider"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMProviderDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Staff PCM Workflow */}
              <Route
                path="/pcm/staff"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMStaffWorkflow />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* PCM Patient Setup/Enrollment */}
              <Route
                path="/pcm/setup"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMPatientSetup />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pcm/setup/:patientId"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMPatientSetup />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pcm/goals"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMPatientGoals />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient-consent"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PatientConsent />
                  </Suspense>
                }
              />
              <Route
                path="/pcm-patient-setup"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PCMPatientSetup />
                  </Suspense>
                }
              />
              <Route
                path="/pcm/profile"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMPatientProfile />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pcm/messages"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMMessages />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* PCM Lab Management */}
              <Route
                path="/pcm/labs"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMLabOrders />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pcm/patient/labs"
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <PCMPatientLabs />
                  </Suspense>
                }
              />

              {/* PCM AI Call Summaries */}
              <Route
                path="/pcm/calls"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <PCMCallSummaries />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* ===== DIABETES EDUCATION ROUTES ===== */}
              <Route
                path="/diabetes-education"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingSpinner />}>
                      <DiabetesEducationAdmin />
                    </Suspense>
                  </ProtectedRoute>
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
// Build trigger: 1762181776
