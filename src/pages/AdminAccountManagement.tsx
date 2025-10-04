import { useState, useEffect } from 'react';
import {
  accountCreationService,
  type MedicalProfessional,
} from '../services/accountCreation.service';

export default function AdminAccountManagement() {
  const [accounts, setAccounts] = useState<MedicalProfessional[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<MedicalProfessional | null>(null);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copySuccess, setCopySuccess] = useState<string>('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    const allAccounts = accountCreationService.getAllAccounts();
    setAccounts(allAccounts);
  };

  const handleResetPassword = async (account: MedicalProfessional) => {
    const newPassword = await accountCreationService.resetPassword(account.email);
    if (newPassword) {
      setResetPassword(newPassword);
      setSelectedAccount(account);
      setShowResetModal(true);
      loadAccounts(); // Reload to show updated requiresPasswordChange status
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(type);
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const filteredAccounts = accounts.filter(
    account =>
      account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.practice.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (account: MedicalProfessional) => {
    if (!account.isActive) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Inactive</span>
      );
    }
    if (account.requiresPasswordChange) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
          Password Reset Required
        </span>
      );
    }
    if (!account.lastLogin) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
          Never Logged In
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Account Management</h1>
              <p className="text-gray-600 mt-2">Manage doctor accounts and reset passwords</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => (window.location.href = '/admin/pumpdrive-users')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                PumpDrive Users & Database
              </button>
              <button
                onClick={() => (window.location.href = '/admin/create-accounts')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Create New Accounts
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, email, or practice..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-gray-900">{accounts.length}</div>
            <div className="text-sm text-gray-600">Total Accounts</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-green-600">
              {accounts.filter(a => a.isActive && !a.requiresPasswordChange).length}
            </div>
            <div className="text-sm text-gray-600">Active Users</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-yellow-600">
              {accounts.filter(a => a.requiresPasswordChange).length}
            </div>
            <div className="text-sm text-gray-600">Need Password Reset</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-gray-600">
              {accounts.filter(a => !a.lastLogin).length}
            </div>
            <div className="text-sm text-gray-600">Never Logged In</div>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Practice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {account.firstName} {account.lastName}
                      </div>
                      <div className="text-xs text-gray-500">ID: {account.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{account.practice}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{account.email}</div>
                    <div className="text-xs text-gray-500">Username: {account.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(account)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {account.lastLogin
                        ? new Date(account.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </div>
                    {account.passwordChangedAt && (
                      <div className="text-xs text-gray-500">
                        Password changed: {new Date(account.passwordChangedAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleResetPassword(account)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => {
                          account.isActive = !account.isActive;
                          loadAccounts();
                        }}
                        className={`text-sm font-medium ${
                          account.isActive
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {account.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Password Reset Modal */}
        {showResetModal && selectedAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Password Reset Successful</h2>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">Password has been reset for:</p>
                <p className="font-semibold text-gray-900">
                  {selectedAccount.firstName} {selectedAccount.lastName}
                </p>
                <p className="text-sm text-gray-600">{selectedAccount.email}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">New Temporary Password:</p>
                <div className="flex items-center justify-between bg-white rounded px-3 py-2 border">
                  <code className="text-lg font-mono text-blue-600">{resetPassword}</code>
                  <button
                    onClick={() => copyToClipboard(resetPassword, 'reset-password')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {copySuccess === 'reset-password' ? '✓' : '📋'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  User will be required to change this on next login
                </p>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                <p className="mb-2">📧 Send this information to the user:</p>
                <div className="bg-gray-50 rounded p-3 text-xs">
                  <button
                    onClick={() => {
                      const message = `Your TSHLA Medical account password has been reset.\n\nTemporary Password: ${resetPassword}\n\nPlease login at https://www.tshla.ai/login and you will be prompted to create a new password.\n\nIf you did not request this reset, please contact support immediately.`;
                      copyToClipboard(message, 'email-template');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {copySuccess === 'email-template' ? 'Copied!' : 'Copy Email Template'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowResetModal(false);
                  setSelectedAccount(null);
                  setResetPassword('');
                }}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">📌 Account Management Information</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• All passwords are stored as secure bcrypt hashes in the database</li>
            <li>• Temporary passwords use format: [4-letter word][4 digits] (e.g., Care1234)</li>
            <li>• Users are required to change temporary passwords on first login</li>
            <li>• Password history is maintained to prevent reuse of last 5 passwords</li>
            <li>• New passwords must be at least 8 characters with mixed case and numbers</li>
            <li>
              • All account data persists in browser localStorage (production would use real
              database)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
