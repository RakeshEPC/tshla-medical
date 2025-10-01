import { useState } from 'react';
import { accountCreationService } from '../services/accountCreation.service';

export default function QuickAccountSetup() {
  const [status, setStatus] = useState('');
  const [credentials, setCredentials] = useState<any[]>([]);

  const setupAccounts = async () => {
    setStatus('Creating accounts...');

    const emails = [
      'veena.watwe@houstondiabetescenter.com',
      'Ghislaine.Tonye@endocrineandpsychiatry.com',
      'radha.bernander@endocrineandpsychiatry.com',
      'Elina.Shakya@houstondiabetescenter.com',
      'cindy.laverde@endocrineandpsychiatry.com',
    ];

    try {
      const accounts = await accountCreationService.createAccounts(emails);
      setCredentials(accounts);
      setStatus('Accounts created successfully!');
    } catch (error) {
      setStatus('Error creating accounts: ' + error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Quick Account Setup</h1>

        <button
          onClick={setupAccounts}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mb-6"
        >
          Create Medical Professional Accounts
        </button>

        <p className="mb-4">{status}</p>

        {credentials.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Account Credentials:</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Password</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((acc, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">
                      {acc.firstName} {acc.lastName}
                    </td>
                    <td className="py-2">{acc.email}</td>
                    <td className="py-2 font-mono">{acc.plainPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 p-4 bg-yellow-50 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Save these passwords now. They are only shown once for
                security. Users will be required to change their password on first login.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
