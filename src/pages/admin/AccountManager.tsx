import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NewAccount {
  accountType: 'admin' | 'staff' | 'patient';
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

export default function AccountManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newAccount, setNewAccount] = useState<NewAccount>({
    accountType: 'staff',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'doctor',
    specialty: '',
    practice: 'TSHLA Medical',
    enablePumpDrive: true
  });

  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    avaId?: string;
    accountType: string;
  } | null>(null);

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You must be an admin to access this page.</p>
          <button
            onClick={() => navigate('/doctor')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const generateAvaId = (): string => {
    const num1 = Math.floor(100 + Math.random() * 900);
    const num2 = Math.floor(100 + Math.random() * 900);
    return `AVA ${num1}-${num2}`;
  };

  const generatePassword = (): string => {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setMessage(null);
    setCreatedCredentials(null);

    try {
      // Get auth session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call backend API to create account (uses service role to bypass RLS)
      const API_URL = import.meta.env.VITE_ADMIN_ACCOUNT_API_URL || 'http://localhost:3004';
      const response = await fetch(`${API_URL}/api/accounts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newAccount)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account');
      }

      const avaId = result.user.avaId;

      // Success!
      setMessage({
        type: 'success',
        text: `Account created successfully for ${newAccount.email}!`
      });

      setCreatedCredentials({
        email: newAccount.email,
        password: newAccount.password,
        avaId,
        accountType: newAccount.accountType
      });

      // Reset form
      setNewAccount({
        accountType: 'staff',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'doctor',
        specialty: '',
        practice: 'TSHLA Medical',
        enablePumpDrive: true
      });

    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to create account'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleGeneratePassword = () => {
    const password = generatePassword();
    setNewAccount({ ...newAccount, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Account Manager</h1>
                <p className="text-gray-600">Create and manage user accounts</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/doctor')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Account Creation Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Account</h2>

          <form onSubmit={handleCreateAccount} className="space-y-6">
            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
              <div className="grid grid-cols-3 gap-3">
                {['admin', 'staff', 'patient'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewAccount({ ...newAccount, accountType: type as any })}
                    className={`py-3 px-4 rounded-lg font-medium transition-all ${
                      newAccount.accountType === type
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Email and Password */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAccount.password}
                    onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Generate secure password"
                  >
                    🔐
                  </button>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={newAccount.firstName}
                  onChange={(e) => setNewAccount({ ...newAccount, firstName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={newAccount.lastName}
                  onChange={(e) => setNewAccount({ ...newAccount, lastName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            {/* Staff-specific fields */}
            {(newAccount.accountType === 'admin' || newAccount.accountType === 'staff') && (
              <div className="grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={newAccount.role}
                    onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                  <input
                    type="text"
                    value={newAccount.specialty}
                    onChange={(e) => setNewAccount({ ...newAccount, specialty: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Internal Medicine"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Practice</label>
                  <input
                    type="text"
                    value={newAccount.practice}
                    onChange={(e) => setNewAccount({ ...newAccount, practice: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="TSHLA Medical"
                  />
                </div>
              </div>
            )}

            {/* Patient-specific fields */}
            {newAccount.accountType === 'patient' && (
              <div className="grid md:grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={newAccount.phoneNumber}
                    onChange={(e) => setNewAccount({ ...newAccount, phoneNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="555-0100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={newAccount.dateOfBirth}
                    onChange={(e) => setNewAccount({ ...newAccount, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAccount.enablePumpDrive !== false}
                      onChange={(e) => setNewAccount({ ...newAccount, enablePumpDrive: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable PumpDrive Access</span>
                  </label>
                </div>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}

            {/* Created Credentials Display */}
            {createdCredentials && (
              <div className="p-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <div className="flex items-start gap-3 mb-4">
                  <svg className="w-6 h-6 text-yellow-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-900 mb-2">Account Created - Save These Credentials!</h3>
                    <p className="text-sm text-yellow-800 mb-4">This information will not be shown again. Make sure to save it securely.</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Email:</span>
                    <span className="font-mono text-gray-900">{createdCredentials.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Password:</span>
                    <span className="font-mono text-gray-900">{createdCredentials.password}</span>
                  </div>
                  {createdCredentials.avaId && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">AVA ID:</span>
                      <span className="font-mono text-gray-900">{createdCredentials.avaId}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Login URL:</span>
                    <span className="font-mono text-blue-600">
                      {createdCredentials.accountType === 'patient' ? '/patient-login' : '/login'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreating}
              className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${
                isCreating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-[1.02]'
              }`}
            >
              {isCreating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating Account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Admin Accounts</h3>
            <p className="text-sm text-gray-600">Full access to all features including account management and system settings.</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Staff Accounts</h3>
            <p className="text-sm text-gray-600">Medical staff can access patient records, dictation, and clinical features.</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Patient Accounts</h3>
            <p className="text-sm text-gray-600">Patients get AVA ID for login and optional PumpDrive access for insulin pump selection.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
