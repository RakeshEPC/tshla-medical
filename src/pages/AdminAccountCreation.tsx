import { useState, useEffect } from 'react';
import { medicalAuthService } from '../services/medicalAuth.service';

interface DatabaseAccount {
  id: number;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  practice?: string;
  specialty?: string;
  isActive: boolean;
  lastLogin?: string;
}

export default function AdminAccountCreation() {
  const [accounts, setAccounts] = useState<DatabaseAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Load existing accounts from database
    loadDatabaseAccounts();
  }, []);

  const loadDatabaseAccounts = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Since we don't have a "list all" endpoint, we'll show a message about the migration
      setAccounts([]);
      setError(''); // Clear any previous errors
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const runMigration = () => {
    // Show instructions for running the migration script
    const instructions = `To migrate all doctor accounts to the database, run this command in your terminal:

cd /Users/rakeshpatel/Desktop/tshla-medical
node server/migrate-doctors-to-database.js

This will:
1. Create accounts for all existing doctors
2. Set temporary password: Welcome2025!
3. Require password change on first login
4. Remove all hardcoded credentials

After migration, doctors can login at:
http://localhost:5173/login`;

    alert(instructions);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Doctor Account Migration</h1>
              <p className="text-gray-600">Migrate existing doctor accounts to secure database storage</p>
            </div>
          </div>
        </div>

        {/* Migration Status */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready for Migration</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-3">📋 Accounts to be migrated:</h3>
              <div className="grid md:grid-cols-2 gap-2 text-sm text-blue-800">
                <div>• rakesh.patel@tshla.ai</div>
                <div>• veena.watwe@tshla.ai</div>
                <div>• tess.chamakkala@tshla.ai</div>
                <div>• radha.bernander@tshla.ai</div>
                <div>• shannon.gregroek@tshla.ai</div>
                <div>• elinia.shakya@tshla.ai</div>
                <div>• patelcyfair@yahoo.com</div>
                <div>• docparikh@gmail.com</div>
                <div>• admin@tshla.ai</div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800">
                <strong>🔐 Temporary Password:</strong> Welcome2025! <br />
                <small>(All users will be required to change password on first login)</small>
              </p>
            </div>

            <button
              onClick={runMigration}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              📋 View Migration Instructions
            </button>

            <div className="mt-6 text-sm text-gray-600">
              <p>After migration, all hardcoded credentials will be removed from the codebase.</p>
              <p>New doctors can register through the <strong>/medical/register</strong> page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
