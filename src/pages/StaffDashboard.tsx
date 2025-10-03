import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DoctorDashboardUnified from './DoctorDashboardUnified';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

/**
 * Role-based dashboard router
 * Directs staff to appropriate dashboard based on their role
 */
export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // For now, all roles use the same dashboard
    // In future, we can create separate dashboards for each role
    switch (user.role) {
      case 'doctor':
      case 'dietician':
      case 'psychiatrist':
      case 'nurse':
      case 'admin':
        // All roles currently use the doctor dashboard
        // This can be expanded with role-specific dashboards later
        break;
      default:
        logWarn('StaffDashboard', 'Warning message', {});
    }
  }, [user, navigate]);

  // Render the appropriate dashboard based on role
  // For now, all roles see the doctor dashboard with role-specific features
  return (
    <div>
      {user && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">Welcome, {user.name}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.role === 'dietician'
                    ? 'Dietician'
                    : user.role === 'psychiatrist'
                      ? 'Psychiatrist'
                      : user.role === 'nurse'
                        ? 'Nurse'
                        : user.role === 'admin'
                          ? 'Administrator'
                          : 'Doctor'}
                </span>
                {user.specialty && <span className="text-xs text-blue-600">{user.specialty}</span>}
              </div>
              <div className="text-xs text-blue-600">Role-based features enabled</div>
            </div>
          </div>
        </div>
      )}

      {/* Render the doctor dashboard for all roles (for now) */}
      <DoctorDashboardUnified />

      {/* Role-specific feature hints */}
      {user?.role === 'dietician' && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 max-w-sm">
          <h4 className="font-semibold text-green-900 mb-2">Dietician Features</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Nutrition assessment tools available</li>
            <li>• Meal planning features enabled</li>
            <li>• Diabetes dietary management active</li>
          </ul>
        </div>
      )}

      {user?.role === 'psychiatrist' && (
        <div className="fixed bottom-4 right-4 bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-sm">
          <h4 className="font-semibold text-purple-900 mb-2">Psychiatrist Features</h4>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>• Mental health assessment tools</li>
            <li>• Psychiatric evaluation forms</li>
            <li>• Medication management system</li>
          </ul>
        </div>
      )}

      {user?.role === 'nurse' && (
        <div className="fixed bottom-4 right-4 bg-pink-50 border border-pink-200 rounded-lg p-4 max-w-sm">
          <h4 className="font-semibold text-pink-900 mb-2">Nurse Features</h4>
          <ul className="text-sm text-pink-700 space-y-1">
            <li>• Vital signs recording</li>
            <li>• Medication administration tracking</li>
            <li>• Care coordination tools</li>
          </ul>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm">
          <h4 className="font-semibold text-red-900 mb-2">Admin Features</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• Full system access granted</li>
            <li>• User management available</li>
            <li>• Audit logs accessible</li>
          </ul>
        </div>
      )}
    </div>
  );
}
