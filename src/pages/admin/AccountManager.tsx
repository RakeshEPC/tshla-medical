import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NewAccount {
  accountType: 'admin' | 'staff' | 'patient' | 'pumpdrive';
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

interface Account {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  fullName: string;
  accountType: string;
  role?: string;
  specialty?: string;
  practice?: string;
  ava_id?: string;
  phone?: string;
  pumpdrive_enabled?: boolean;
  is_active: boolean;
  created_at: string;
  auth_user_id: string;
}

export default function AccountManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'reset'>('create');

  // Create Account State
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
  const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    avaId?: string;
    accountType: string;
  } | null>(null);

  // Manage Accounts State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_ADMIN_ACCOUNT_API_URL || 'http://localhost:3004';

  // Check if user is admin
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
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
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (activeTab === 'manage') {
      loadAccounts();
    }
  }, [activeTab, filterType, searchQuery]);

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
    setCreateMessage(null);
    setCreatedCredentials(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const accountData = {
        ...newAccount,
        enablePumpDrive: newAccount.accountType === 'pumpdrive' ? true : newAccount.enablePumpDrive,
        accountType: newAccount.accountType === 'pumpdrive' ? 'patient' : newAccount.accountType
      };

      const response = await fetch(`${API_URL}/api/accounts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(accountData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account');
      }

      setCreateMessage({
        type: 'success',
        text: `Account created successfully for ${newAccount.email}!`
      });

      setCreatedCredentials({
        email: newAccount.email,
        password: newAccount.password,
        avaId: result.user.avaId,
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
      setCreateMessage({
        type: 'error',
        text: error.message || 'Failed to create account'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('accountType', filterType);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_URL}/api/accounts/list?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setAccounts(result.accounts);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetMessage(null);
    setNewPassword(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${API_URL}/api/accounts/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: resetEmail })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setResetMessage({
        type: 'success',
        text: `Password reset successfully for ${resetEmail}`
      });
      setNewPassword(result.newPassword);
      setResetEmail('');
    } catch (error: any) {
      setResetMessage({
        type: 'error',
        text: error.message || 'Failed to reset password'
      });
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getAccountTypeBadge = (type: string) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      staff: 'bg-blue-100 text-blue-800',
      patient: 'bg-green-100 text-green-800',
      pumpdrive: 'bg-orange-100 text-orange-800'
    };
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Account Manager</h1>
                <p className="text-gray-600">Create and manage all user accounts</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'create'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ➕ Create Account
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'manage'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 Manage Accounts
            </button>
            <button
              onClick={() => setActiveTab('reset')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'reset'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔑 Reset Password
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* CREATE ACCOUNT TAB */}
          {activeTab === 'create' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Account</h2>

              <form onSubmit={handleCreateAccount} className="space-y-6">
                {/* Account Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { value: 'admin', label: 'Admin', icon: '👑' },
                      { value: 'staff', label: 'Staff/Doctor', icon: '👨‍⚕️' },
                      { value: 'patient', label: 'Patient', icon: '🧑' },
                      { value: 'pumpdrive', label: 'PumpDrive Patient', icon: '💊' }
                    ].map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNewAccount({ ...newAccount, accountType: type.value as any })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          newAccount.accountType === type.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">{type.icon}</div>
                        <div className="text-sm font-semibold">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      value={newAccount.firstName}
                      onChange={e => setNewAccount({ ...newAccount, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={newAccount.lastName}
                      onChange={e => setNewAccount({ ...newAccount, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newAccount.email}
                    onChange={e => setNewAccount({ ...newAccount, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAccount.password}
                      onChange={e => setNewAccount({ ...newAccount, password: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setNewAccount({ ...newAccount, password: generatePassword() })}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* Staff-specific fields */}
                {(newAccount.accountType === 'admin' || newAccount.accountType === 'staff') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <select
                          value={newAccount.role}
                          onChange={e => setNewAccount({ ...newAccount, role: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                          onChange={e => setNewAccount({ ...newAccount, specialty: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Internal Medicine"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Practice</label>
                      <input
                        type="text"
                        value={newAccount.practice}
                        onChange={e => setNewAccount({ ...newAccount, practice: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Patient-specific fields */}
                {(newAccount.accountType === 'patient' || newAccount.accountType === 'pumpdrive') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={newAccount.phoneNumber}
                        onChange={e => setNewAccount({ ...newAccount, phoneNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="555-0123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <input
                        type="date"
                        value={newAccount.dateOfBirth}
                        onChange={e => setNewAccount({ ...newAccount, dateOfBirth: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Messages */}
                {createMessage && (
                  <div className={`p-4 rounded-lg ${
                    createMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    {createMessage.text}
                  </div>
                )}

                {/* Created Credentials Display */}
                {createdCredentials && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-bold text-blue-900 mb-4">✅ Account Created Successfully!</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-white rounded p-3">
                        <div>
                          <div className="text-xs text-gray-500">Email</div>
                          <div className="font-mono">{createdCredentials.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(createdCredentials.email)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-white rounded p-3">
                        <div>
                          <div className="text-xs text-gray-500">Password</div>
                          <div className="font-mono">{createdCredentials.password}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(createdCredentials.password)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Copy
                        </button>
                      </div>
                      {createdCredentials.avaId && (
                        <div className="flex items-center justify-between bg-white rounded p-3">
                          <div>
                            <div className="text-xs text-gray-500">AVA ID</div>
                            <div className="font-mono text-lg font-bold text-blue-600">{createdCredentials.avaId}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(createdCredentials.avaId!)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-blue-700 mt-4">⚠️ Save these credentials securely! The password won't be shown again.</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isCreating}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                    isCreating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isCreating ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}

          {/* MANAGE ACCOUNTS TAB */}
          {activeTab === 'manage' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Manage Accounts</h2>

              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by name, email, or AVA ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Accounts</option>
                  <option value="admin">Admins</option>
                  <option value="staff">Staff/Doctors</option>
                  <option value="patient">Patients</option>
                  <option value="pumpdrive">PumpDrive Patients</option>
                </select>
                <button
                  onClick={loadAccounts}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Refresh
                </button>
              </div>

              {/* Accounts Table */}
              {isLoadingAccounts ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading accounts...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {accounts.map(account => (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{account.fullName}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                            {account.email}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeBadge(account.accountType)}`}>
                              {account.accountType}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                            {account.ava_id && <div>AVA: {account.ava_id}</div>}
                            {account.specialty && <div>{account.specialty}</div>}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => {
                                setResetEmail(account.email);
                                setActiveTab('reset');
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {accounts.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      No accounts found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RESET PASSWORD TAB */}
          {activeTab === 'reset' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Reset Password</h2>

              <form onSubmit={handleResetPassword} className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address or AVA ID
                  </label>
                  <input
                    type="text"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="user@example.com or AVA 123-456"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Enter the email address or AVA ID of the account you want to reset
                  </p>
                </div>

                {resetMessage && (
                  <div className={`p-4 rounded-lg ${
                    resetMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    {resetMessage.text}
                  </div>
                )}

                {newPassword && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-bold text-blue-900 mb-4">🔑 New Password Generated</h3>
                    <div className="flex items-center justify-between bg-white rounded p-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">New Password</div>
                        <div className="font-mono text-lg font-bold">{newPassword}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newPassword)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <p className="text-sm text-blue-700 mt-4">
                      ⚠️ Save this password securely and share it with the user. It won't be shown again.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isResetting}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                    isResetting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isResetting ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-2">ℹ️ Password Reset Process</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• A new secure password will be automatically generated</li>
                  <li>• The user's current password will be immediately replaced</li>
                  <li>• Share the new password with the user securely</li>
                  <li>• The user can change their password after logging in</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
