import React, { useEffect, useState } from 'react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface Application {
  name: string;
  email: string;
  title: string;
  specialty: string;
  applications: string;
  whyInterested: string;
  submittedAt: string;
  source: string;
}

const EarlyAccessAdmin: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [showDetails, setShowDetails] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'backend' | 'localStorage' | 'both'>('both');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    const allApplications: Application[] = [];

    // Try to load from backend API
    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.tshla.ai';
    try {
      // Check if user has auth token (from doctor login)
      const authToken = localStorage.getItem('authToken');

      if (authToken) {
        const response = await fetch(`${apiUrl}/api/early-access`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const backendApps = await response.json();
          allApplications.push(...backendApps);
          setDataSource('backend');
        }
      }
    } catch (err) {
      logDebug('EarlyAccessAdmin', 'Debug message', {});
    }

    // Also load from localStorage
    const storedApplications = JSON.parse(localStorage.getItem('earlyAccessApplications') || '[]');

    // Merge and deduplicate based on email
    const merged = [...allApplications, ...storedApplications];
    const unique = merged.filter(
      (app, index, self) => index === self.findIndex(a => a.email === app.email)
    );

    setApplications(unique);
    if (unique.length > allApplications.length && allApplications.length > 0) {
      setDataSource('both');
    } else if (allApplications.length === 0) {
      setDataSource('localStorage');
    }

    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = [
      'Name',
      'Email',
      'Title',
      'Specialty',
      'Applications',
      'Why Interested',
      'Submitted At',
      'Source',
    ];
    const rows = applications.map(app => [
      app.name,
      app.email,
      app.title,
      app.specialty,
      app.applications,
      app.whyInterested.replace(/,/g, ';'), // Replace commas to avoid CSV issues
      app.submittedAt,
      app.source,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `early-access-applications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const clearApplications = () => {
    if (window.confirm('Are you sure you want to clear all applications? This cannot be undone.')) {
      localStorage.removeItem('earlyAccessApplications');
      setApplications([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Early Access Applications</h1>
            {!loading && applications.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Data source:{' '}
                {dataSource === 'backend'
                  ? '🌐 Backend Database'
                  : dataSource === 'localStorage'
                    ? '💾 Local Storage'
                    : '🔄 Backend + Local Storage'}
                ({applications.length} applications)
              </p>
            )}
          </div>
          <div className="space-x-4">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              disabled={applications.length === 0}
            >
              Export to CSV
            </button>
            <button
              onClick={clearApplications}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={applications.length === 0}
            >
              Clear All
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Loading applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              No applications yet. Share your landing page to start collecting submissions!
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Applications will appear here when submitted through the form.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applications
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {applications.map((app, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {app.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {app.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {app.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate">{app.applications}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setShowDetails(showDetails === index ? null : index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {showDetails === index ? 'Hide' : 'View'} Details
                        </button>
                      </td>
                    </tr>
                    {showDetails === index && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div>
                              <span className="font-semibold text-gray-700">Specialty:</span>{' '}
                              <span className="text-gray-600">
                                {app.specialty || 'Not specified'}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">
                                Applications Interested In:
                              </span>{' '}
                              <span className="text-gray-600">{app.applications}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Why Interested:</span>
                              <p className="text-gray-600 mt-1">{app.whyInterested}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Source:</span>{' '}
                              <span className="text-gray-600">{app.source}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Submitted At:</span>{' '}
                              <span className="text-gray-600">
                                {new Date(app.submittedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">📝 Admin Access:</h2>
          <p className="text-sm text-blue-700">
            {dataSource === 'backend'
              ? 'Applications are being fetched from the backend database. You are logged in as an admin.'
              : dataSource === 'both'
                ? 'Showing combined data from backend database and local browser storage.'
                : 'Applications shown from browser localStorage. Log in as a doctor to access backend database.'}
          </p>
          <p className="text-sm text-blue-600 mt-2">
            Access this admin page at{' '}
            <code className="bg-blue-100 px-1 rounded">/early-access-admin</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EarlyAccessAdmin;
