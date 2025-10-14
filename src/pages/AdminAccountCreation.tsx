import { useState } from 'react';
import { supabaseAuthService } from '../services/supabaseAuth.service';

interface FormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  specialty?: string;
  practice?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  enablePumpDrive?: boolean;
}

export default function AdminAccountCreation() {
  const [accountType, setAccountType] = useState<'staff' | 'patient'>('staff');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'doctor',
    specialty: '',
    practice: '',
    phoneNumber: '',
    dateOfBirth: '',
    enablePumpDrive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdAccounts, setCreatedAccounts] = useState<Array<{ email: string; password: string; type: string }>>([]);

  const generatePassword = () => {
    // Generate secure random password: 12 characters, mixed case, numbers, symbols
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (accountType === 'staff') {
        // Create medical staff account
        const result = await supabaseAuthService.registerMedicalStaff({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role || 'doctor',
          specialty: formData.specialty,
          practice: formData.practice,
        });

        if (result.success) {
          setMessage({
            type: 'success',
            text: `Staff account created successfully for ${formData.firstName} ${formData.lastName}!`,
          });
          setCreatedAccounts([
            ...createdAccounts,
            { email: formData.email, password: formData.password, type: 'Medical Staff' }
          ]);
          // Reset form
          setFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            role: 'doctor',
            specialty: '',
            practice: '',
            phoneNumber: '',
            dateOfBirth: '',
            enablePumpDrive: true,
          });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to create staff account' });
        }
      } else {
        // Create patient account
        const result = await supabaseAuthService.registerPatient({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          dateOfBirth: formData.dateOfBirth,
          enablePumpDrive: formData.enablePumpDrive,
        });

        if (result.success) {
          setMessage({
            type: 'success',
            text: `Patient account created successfully for ${formData.firstName} ${formData.lastName}!`,
          });
          setCreatedAccounts([
            ...createdAccounts,
            {
              email: formData.email,
              password: formData.password,
              type: formData.enablePumpDrive ? 'Patient (PumpDrive Enabled)' : 'Patient'
            }
          ]);
          // Reset form
          setFormData({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            role: 'doctor',
            specialty: '',
            practice: '',
            phoneNumber: '',
            dateOfBirth: '',
            enablePumpDrive: true,
          });
        } else {
          // Check for email confirmation requirement
          if (result.error === 'CONFIRMATION_REQUIRED') {
            setMessage({
              type: 'error',
              text: 'EMAIL VERIFICATION IS ENABLED! Patient account created but cannot login until email is verified. Disable email verification in Supabase dashboard (see instructions below).',
            });
          } else {
            setMessage({ type: 'error', text: result.error || 'Failed to create patient account' });
          }
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13.5 3.5v-1a1 1 0 011-1h3a1 1 0 011 1v1" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Account Creation</h1>
              <p className="text-gray-600">Create staff and patient accounts for your clinic</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8">
            {/* Account Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Account Type</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setAccountType('staff')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                    accountType === 'staff'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  Medical Staff (Doctors, Nurses)
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('patient')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                    accountType === 'patient'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  Patient
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Common Fields */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter or generate password"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters recommended</p>
              </div>

              {/* Staff-specific fields */}
              {accountType === 'staff' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="doctor">Doctor</option>
                        <option value="nurse">Nurse</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                      <input
                        type="text"
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Family Medicine"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Practice/Clinic Name</label>
                    <input
                      type="text"
                      value={formData.practice}
                      onChange={(e) => setFormData({ ...formData, practice: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Main Street Clinic"
                    />
                  </div>
                </>
              )}

              {/* Patient-specific fields */}
              {accountType === 'patient' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.enablePumpDrive}
                        onChange={(e) => setFormData({ ...formData, enablePumpDrive: e.target.checked })}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Enable PumpDrive (insulin pump recommendation tool)
                      </span>
                    </label>
                  </div>
                </>
              )}

              {/* Message */}
              {message && (
                <div
                  className={`mb-4 p-4 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Account...' : `Create ${accountType === 'staff' ? 'Staff' : 'Patient'} Account`}
              </button>
            </form>
          </div>

          {/* Sidebar - Recently Created & Instructions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Recently Created Accounts */}
            {createdAccounts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Recently Created</h3>
                <div className="space-y-3">
                  {createdAccounts.slice(-5).reverse().map((account, index) => (
                    <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-800 mb-1">{account.type}</div>
                      <div className="text-sm font-medium text-gray-900">{account.email}</div>
                      <div className="text-xs text-gray-600 mt-1">Password: {account.password}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Verification Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="font-semibold text-amber-900 mb-3">Email Verification</h3>
              <p className="text-sm text-amber-800 mb-3">
                If users cannot log in immediately after creation, email verification may be enabled.
              </p>
              <div className="text-xs text-amber-700 space-y-2">
                <p className="font-semibold">To disable:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to Supabase Dashboard</li>
                  <li>Authentication → Settings</li>
                  <li>Turn OFF "Enable email confirmations"</li>
                  <li>Click Save</li>
                </ol>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Quick Tips</h3>
              <ul className="text-xs text-blue-800 space-y-2">
                <li>Passwords are securely hashed by Supabase</li>
                <li>Save the password - users will need it to log in</li>
                <li>Staff can use dictation & EMR features</li>
                <li>Patients with PumpDrive can use pump recommendations</li>
                <li>All accounts save data to Supabase PostgreSQL</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
