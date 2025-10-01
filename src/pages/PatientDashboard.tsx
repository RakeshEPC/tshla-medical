import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patient.service';
import type { Patient } from '../types/patient.types';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pumpdrive' | 'weightloss'>('overview');

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = () => {
    const currentPatient = patientService.getCurrentPatient();

    if (!currentPatient) {
      navigate('/patient-login');
      return;
    }

    setPatient(currentPatient);
    setIsLoading(false);
  };

  const handleLogout = () => {
    patientService.logout();
    navigate('/patient-login');
  };

  const getInitials = () => {
    if (!patient) return '';
    return `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                {getInitials()}
              </div>
              <div>
                <div className="text-sm text-gray-500">Welcome back,</div>
                <div className="font-semibold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xs text-gray-500">Your AVA ID</div>
                <div className="font-mono font-semibold text-blue-600">{patient.patientAvaId}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>

              {patient.programs.pumpdrive?.enrolled && (
                <button
                  onClick={() => setActiveTab('pumpdrive')}
                  className={`py-3 px-6 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'pumpdrive'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  PumpDrive
                </button>
              )}

              {patient.programs.weightloss?.enrolled && (
                <button
                  onClick={() => setActiveTab('weightloss')}
                  className={`py-3 px-6 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'weightloss'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Weight Loss Journey
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Profile</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Email:</span>
                  <p className="font-medium text-gray-900">{patient.email}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Phone:</span>
                  <p className="font-medium text-gray-900">{patient.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Member Since:</span>
                  <p className="font-medium text-gray-900">{formatDate(patient.createdAt)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Last Login:</span>
                  <p className="font-medium text-gray-900">{formatDate(patient.lastLogin)}</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/patient/profile/edit')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Edit Profile →
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {patient.programs.pumpdrive?.enrolled && (
                  <>
                    {!patient.programs.pumpdrive.finalRecommendations ? (
                      <button
                        onClick={() => navigate('/pumpdrive')}
                        className="w-full p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg text-left hover:from-blue-100 hover:to-blue-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-blue-900">Continue PumpDrive</div>
                            <div className="text-sm text-blue-700">
                              Complete your pump selection journey
                            </div>
                          </div>
                          <span className="text-2xl">→</span>
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/patient/pump-report')}
                        className="w-full p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg text-left hover:from-green-100 hover:to-green-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-green-900">View Pump Report</div>
                            <div className="text-sm text-green-700">
                              Your personalized recommendations
                            </div>
                          </div>
                          <span className="text-2xl">📄</span>
                        </div>
                      </button>
                    )}
                  </>
                )}

                {patient.programs.weightloss?.enrolled && (
                  <>
                    <button
                      onClick={() => navigate('/weightloss/checkin')}
                      className="w-full p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg text-left hover:from-purple-100 hover:to-purple-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-purple-900">Daily Check-in</div>
                          <div className="text-sm text-purple-700">Track your progress today</div>
                        </div>
                        <span className="text-2xl">📝</span>
                      </div>
                    </button>

                    <button
                      onClick={() => navigate('/patient/chat')}
                      className="w-full p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg text-left hover:from-orange-100 hover:to-orange-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-orange-900">Chat with AVA AI</div>
                          <div className="text-sm text-orange-700">Get personalized guidance</div>
                        </div>
                        <span className="text-2xl">💬</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pumpdrive' && (
          <div className="space-y-6">
            {/* PumpDrive Status */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">PumpDrive Journey</h2>

              {patient.programs.pumpdrive?.finalRecommendations ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-3xl">✅</div>
                      <div>
                        <div className="font-semibold text-green-900">Journey Complete!</div>
                        <div className="text-sm text-green-700">
                          Your personalized pump recommendations are ready
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Recommendations Preview */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Your Top Recommendations:</h3>
                    {patient.programs.pumpdrive.finalRecommendations
                      .slice(0, 2)
                      .map((rec, index) => (
                        <div
                          key={rec.pumpId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0 ? 'bg-gold-500' : 'bg-silver-500'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{rec.pumpName}</div>
                              <div className="text-sm text-gray-600">{rec.matchScore}% match</div>
                            </div>
                          </div>
                          {index === 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Best Match
                            </span>
                          )}
                        </div>
                      ))}
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => navigate('/patient/pump-report')}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
                    >
                      View Full Report
                    </button>
                    <button
                      onClick={() => navigate('/patient/chat')}
                      className="flex-1 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
                    >
                      Discuss with AVA
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Ready to find your perfect insulin pump? Our AI-powered journey will help you
                    make the best choice.
                  </p>

                  {/* Progress Indicator */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span>Categories Completed</span>
                      <span>{patient.programs.pumpdrive?.completedCategories?.length || 0}/6</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                        style={{
                          width: `${((patient.programs.pumpdrive?.completedCategories?.length || 0) / 6) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/pumpdrive')}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
                  >
                    {patient.programs.pumpdrive?.completedCategories?.length
                      ? 'Continue Journey'
                      : 'Start PumpDrive Journey'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'weightloss' && (
          <div className="space-y-6">
            {/* Weight Loss Status */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Weight Loss Journey</h2>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm text-gray-600">Progress Dashboard</div>
                  <button
                    onClick={() => navigate('/weightloss/dashboard')}
                    className="mt-2 text-green-600 hover:text-green-700 font-medium"
                  >
                    View →
                  </button>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl mb-2">✅</div>
                  <div className="text-sm text-gray-600">Daily Check-in</div>
                  <button
                    onClick={() => navigate('/weightloss/checkin')}
                    className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Check In →
                  </button>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl mb-2">💬</div>
                  <div className="text-sm text-gray-600">AI Coach Chat</div>
                  <button
                    onClick={() => navigate('/patient/chat')}
                    className="mt-2 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Chat →
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Current Phase</div>
                    <div className="font-semibold capitalize">
                      {patient.programs.weightloss?.currentPhase || 'Onboarding'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Last Check-in</div>
                    <div className="font-semibold">
                      {formatDate(patient.programs.weightloss?.lastCheckin) || 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
