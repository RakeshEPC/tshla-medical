/**
 * Audit Logs Admin Page
 *
 * View and analyze audit logs for HIPAA compliance
 * Part of HIPAA Phase 7: Enhanced Audit Logging
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { enhancedAuditService, AuditLog, AuditStatistics } from '../../services/enhancedAudit.service';
import { Download, AlertTriangle, Activity, Users, Database, Eye } from 'lucide-react';

export default function AuditLogs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    action?: string;
    resourceType?: string;
    containsPHI?: boolean;
    success?: boolean;
    days: number;
  }>({ days: 7 });

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      navigate('/dashboard');
      return;
    }

    loadData();
  }, [user, filter]);

  const loadData = async () => {
    setLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - filter.days);

    const [logsData, statsData] = await Promise.all([
      enhancedAuditService.getAuditLogs(
        {
          action: filter.action as any,
          resourceType: filter.resourceType as any,
          containsPHI: filter.containsPHI,
          success: filter.success,
          startDate,
          endDate: new Date()
        },
        100
      ),
      enhancedAuditService.getStatistics(startDate, new Date())
    ]);

    setLogs(logsData);
    setStatistics(statsData);
    setLoading(false);
  };

  const handleExport = async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - filter.days);

    const csv = await enhancedAuditService.exportToCSV({
      startDate,
      endDate: new Date()
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="mt-1 text-sm text-gray-600">
                HIPAA-compliant audit trail for all system activities
              </p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.total_events}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.total_users}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <Eye className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">PHI Access</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.total_phi_access}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Failures</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.total_failures}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={filter.days}
              onChange={(e) => setFilter({ ...filter, days: Number(e.target.value) })}
              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            <select
              value={filter.action || ''}
              onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })}
              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              <option value="view">View</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>

            <select
              value={filter.resourceType || ''}
              onChange={(e) => setFilter({ ...filter, resourceType: e.target.value || undefined })}
              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Resources</option>
              <option value="patient">Patient</option>
              <option value="pump_report">Pump Report</option>
              <option value="medical_record">Medical Record</option>
              <option value="appointment">Appointment</option>
              <option value="session">Session</option>
            </select>

            <select
              value={filter.containsPHI === undefined ? '' : String(filter.containsPHI)}
              onChange={(e) => setFilter({ ...filter, containsPHI: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Events</option>
              <option value="true">PHI Access Only</option>
              <option value="false">Non-PHI Only</option>
            </select>

            <select
              value={filter.success === undefined ? '' : String(filter.success)}
              onChange={(e) => setFilter({ ...filter, success: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PHI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.user_email}</div>
                        <div className="text-xs text-gray-500">{log.user_role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.resource_type}</div>
                        {log.resource_id && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            ID: {log.resource_id}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.contains_phi ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
                            YES
                          </span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.success ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Success
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HIPAA Compliance Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">HIPAA Audit Requirements</p>
              <p className="text-sm text-blue-800">
                This audit log complies with HIPAA §164.312(b) - Audit Controls and §164.308(a)(1)(ii)(D) - Information System Activity Review.
                All logs are retained for 7 years and include comprehensive tracking of PHI access, user actions, and security events.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
